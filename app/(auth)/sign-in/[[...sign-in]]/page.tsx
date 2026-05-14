import { SignIn } from "@clerk/nextjs";

/**
 * Clerk-hosted sign-in route for App Router authentication.
 */
const SignInPage = () => {
  return (
    <main className="flex flex-1 items-center justify-center">
      <SignIn />
    </main>
  );
};

export default SignInPage;
