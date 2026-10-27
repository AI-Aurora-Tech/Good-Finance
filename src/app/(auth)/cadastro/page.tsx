import { AuthForm } from "../auth-form";

export const metadata = { title: "Criar conta" };

export default function SignUpPage() {
  return <AuthForm mode="signup" />;
}
