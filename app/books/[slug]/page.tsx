import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getBookBySlug } from "@/lib/actions/book.actions";
import { normalizeFocusTopics } from "@/lib/preparation/focus";
import { guardInterventionPage } from "@/lib/study/access";
import VapiControls from "@/components/VapiControls";

export default async function BookDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ focus?: string }>;
}) {
  await guardInterventionPage();

  const { slug } = await params;
  // Comes from the "practicar solo estos temas" button of the preparation map.
  // Unknown ids are dropped here, so a hand-edited URL cannot invent a topic.
  const { focus } = await searchParams;
  const focusTopics = normalizeFocusTopics(focus);
  const result = await getBookBySlug(slug);

  if (!result.success || !result.data) {
    redirect("/");
  }

  const book = result.data;

  return (
    <div className="book-page-container">
      <Link href="/" className="back-btn-floating">
        <ArrowLeft className="size-6 text-[#212a3b]" />
      </Link>

      <VapiControls book={book} focusTopics={focusTopics} />
    </div>
  );
}
