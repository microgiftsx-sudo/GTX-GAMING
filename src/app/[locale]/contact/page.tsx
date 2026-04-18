import { getTranslations } from "next-intl/server";
import ContactPageContent from "@/components/legal/ContactPageContent";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "LegalContact" });
  return {
    title: t("title"),
    description: t("metaDescription"),
  };
}

export default function ContactPage() {
  return <ContactPageContent />;
}
