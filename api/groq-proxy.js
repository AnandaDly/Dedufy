export const config = {
  runtime: "edge",
};

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // Get the messages from the user's request
  const body = await req.json();

  const GROQ_API_KEY = process.env.GROQ_API_KEY; // Your key is stored securely as an environment variable

  if (!GROQ_API_KEY) {
    return new Response(
      JSON.stringify({
        error: { message: "API key not configured on server." },
      }),
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify(body), // Forward the user's request body
      }
    );

    // Stream the response back to the user's browser
    return new Response(response.body, {
      headers: { "Content-Type": "application/json" },
      status: response.status,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: { message: "Error calling Groq API." } }),
      { status: 500 }
    );
  }
}
