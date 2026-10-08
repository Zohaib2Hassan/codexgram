import { SignIn } from "@clerk/react";
import { Screen } from "../components/ui";
export default function WebSignIn() {
  return (
    <Screen title="Admin sign-in">
      <SignIn routing="hash" forceRedirectUrl="/admin" />
    </Screen>
  );
}
