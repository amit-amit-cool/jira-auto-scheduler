import { redirect } from 'next/navigation';

async function hasServerCredentials() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'}/api/jira/server-config`);
    const data = await res.json();
    return data.configured === true;
  } catch {
    return false;
  }
}

export default async function Home() {
  const configured = await hasServerCredentials();
  redirect(configured ? '/dashboard' : '/settings');
}
