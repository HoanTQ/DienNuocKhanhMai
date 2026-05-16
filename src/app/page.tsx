// Root page - middleware redirects to /pos
// This file exists to prevent Next.js 404 on root route during static analysis
export default function Home() {
  return null;
}
