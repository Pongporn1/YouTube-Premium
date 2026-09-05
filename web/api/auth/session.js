import { readSession } from "../../lib/session-core.js";

export default function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }
  const user = readSession(request);
  response.setHeader("Cache-Control", "private, no-store");
  return response.status(200).json(user
    ? { authenticated: true, user: { name: user.name, email: user.email, picture: user.picture } }
    : { authenticated: false });
}
