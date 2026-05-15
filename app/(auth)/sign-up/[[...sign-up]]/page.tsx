import { SignUp } from "@clerk/nextjs";

/**
 * Clerk-hosted sign-up route for App Router authentication.
 */
const SignUpPage = () => {
  return (
    <main className="flex flex-1 items-center justify-center">
      <SignUp />
    </main>
  );
};

export default SignUpPage;
