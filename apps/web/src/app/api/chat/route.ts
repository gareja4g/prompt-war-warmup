import { openai } from "@ai-sdk/openai";
import { streamText, convertToCoreMessages } from "ai";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { getSystemPrompt } from "@/ai/prompts";
import { checkInputSafety, buildSafeContext, validateAIResponse } from "@/ai/safety";
import { assessCrisisLevel, getCrisisResourceMessage } from "@/ai/crisis-detection";
import { buildUserContext, formatContextForPrompt } from "@/ai/context";
import { NextRequest } from "next/server";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { success: rateLimitOk } = await rateLimit(session.user.id, "ai");
  if (!rateLimitOk) {
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded. Please wait before sending another message." }),
      {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    const body = await req.json() as { messages?: unknown[]; conversationId?: string };
    const { messages: rawMessages, conversationId } = body;

    if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
      return new Response(JSON.stringify({ error: "Messages are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const lastMessage = rawMessages[rawMessages.length - 1] as { role?: string; content?: string } | undefined;
    const userContent = lastMessage?.content ?? "";

    // Safety check on user input
    const safetyCheck = checkInputSafety(userContent);
    const crisisAssessment = assessCrisisLevel(userContent);

    // If critical crisis, return crisis response immediately without streaming
    if (crisisAssessment.level === "critical") {
      const crisisMessage = getCrisisResourceMessage();

      if (conversationId) {
        await db.message.createMany({
          data: [
            { conversationId, role: "user", content: userContent },
            { conversationId, role: "assistant", content: crisisMessage },
          ],
        });
      }

      return new Response(
        new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            controller.enqueue(
              encoder.encode(`0:"${crisisMessage.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"\n`)
            );
            controller.close();
          },
        }),
        { headers: { "Content-Type": "text/event-stream" } }
      );
    }

    // Build user context and profile in parallel
    const [userContext, user] = await Promise.all([
      buildUserContext(session.user.id),
      db.user.findUnique({
        where: { id: session.user.id },
        include: { profile: true, settings: true },
      }),
    ]);

    const systemPrompt = getSystemPrompt(
      user?.profile?.examType ?? "NEET",
      user?.name ?? "Student",
      user?.settings?.aiPersonality ?? "supportive"
    );

    const contextSuffix = userContext ? "\n\n" + formatContextForPrompt(userContext) : "";

    // Get or create conversation
    let activeConversationId = conversationId;
    if (!activeConversationId) {
      const conv = await db.conversation.create({
        data: {
          userId: session.user.id,
          title: userContent.slice(0, 50) + (userContent.length > 50 ? "..." : ""),
        },
      });
      activeConversationId = conv.id;
    }

    // Load conversation history (last 20 messages)
    const history = await db.message.findMany({
      where: { conversationId: activeConversationId },
      orderBy: { createdAt: "asc" },
      take: 20,
    });

    const historicalMessages = history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const safeCoreMessages = buildSafeContext([
      ...historicalMessages,
      { role: "user", content: safetyCheck.sanitizedContent },
    ]);

    // Persist user message before streaming starts
    await db.message.create({
      data: {
        conversationId: activeConversationId,
        role: "user",
        content: userContent.slice(0, 2000),
      },
    });

    const result = streamText({
      model: openai("gpt-4o"),
      system: systemPrompt + contextSuffix,
      messages: convertToCoreMessages(safeCoreMessages as Parameters<typeof convertToCoreMessages>[0]),
      maxTokens: 800,
      temperature: 0.7,
      onFinish: async ({ text }) => {
        const validatedResponse = validateAIResponse(text);

        await db.message.create({
          data: {
            conversationId: activeConversationId!,
            role: "assistant",
            content: validatedResponse,
          },
        });

        // Touch updatedAt on the conversation after every exchange
        await db.conversation.update({
          where: { id: activeConversationId! },
          data: { updatedAt: new Date() },
        });
      },
    });

    const response = result.toDataStreamResponse();

    // Propagate conversation ID to the client via a custom header
    const headers = new Headers(response.headers);
    headers.set("X-Conversation-Id", activeConversationId);

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(JSON.stringify({ error: "AI service temporarily unavailable" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}
