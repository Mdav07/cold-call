import { Press_Start_2P } from "next/font/google";
import { Suspense } from "react";
import "../play/play.css";
import { SignInForm } from "./SignInForm";
import { BackButton } from "@/app/ui/BackButton";

const pixel = Press_Start_2P({ weight: "400", subsets: ["latin"], variable: "--font-pixel" });

async function Form({ searchParams }: { searchParams: PageProps<"/signin">["searchParams"] }) {
  const { error } = await searchParams;
  return <SignInForm linkError={error === "link"} />;
}

export default function SignInPage({ searchParams }: PageProps<"/signin">) {
  return (
    <div className={`${pixel.variable} cc-floor-1 relative flex min-h-full flex-1 items-center justify-center p-4 pt-20`}>
      <div className="absolute left-4 top-4">
        <BackButton />
      </div>
      <Suspense fallback={null}>
        <Form searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
