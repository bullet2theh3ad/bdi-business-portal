export async function GET() {
  // Return null for unauthenticated users
  return Response.json(null);
}
