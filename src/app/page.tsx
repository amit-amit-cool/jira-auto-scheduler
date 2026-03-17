import { redirect } from 'next/navigation';

export default function Home() {
  const configured = !!(
    process.env.JIRA_BASE_URL &&
    process.env.JIRA_EMAIL &&
    process.env.JIRA_API_TOKEN
  );
  redirect(configured ? '/dashboard' : '/settings');
}
