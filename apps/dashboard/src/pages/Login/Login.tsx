import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Input, Label } from "@repo/ui";
import { useLoginMutation } from "../../redux/api/authApi";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [login, { isLoading, error }] = useLoginMutation();
  const navigate = useNavigate();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await login({ email, password }).unwrap();
      navigate("/candidates", { replace: true });
    } catch {
      // error state below already reflects the failure
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <form onSubmit={handleSubmit} className="space-y-4 p-8">
          <h1 className="text-lg font-semibold text-foreground">
            Recruiter login
          </h1>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">
              Invalid email or password.
            </p>
          )}

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? "Logging in…" : "Log in"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
