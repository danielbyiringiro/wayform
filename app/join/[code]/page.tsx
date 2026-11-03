import JoinClient from "./JoinClient";

// Route params are promises in this version of Next, so unwrap here and let
// the client component get on with the interactive work.
export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <JoinClient code={code} />;
}
