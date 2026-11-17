import { Press_Start_2P } from "next/font/google";
import { Suspense } from "react";
import "../play/play.css";
import { SignInForm } from "./SignInForm";

const pixel = Press_Start_2P({ weight: "400", subsets: ["latin"], variable: "--font-pixel" });

async function Form({ searchParams }: { searchParams: PageProps<"/signin">["searchParams"] }) {
  const { error } = await searchParams;
  return <SignInForm linkError={error === "link"} />;
}

export default function SignInPage({ searchParams }: PageProps<"/signin">) {
  return (
    <div className={`${pixel.variable} cc-floor-1 flex min-h-full flex-1 items-center justify-center p-4`}>
      <Suspense fallback={null}>
        <Form searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
