import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { buttonVariants, cn } from "@repo/ui";
import { TbArrowRight } from "react-icons/tb";

type Suggestion = {
  route: string;
  label: string;
};

const SUGGESTIONS: readonly Suggestion[] = [
  { route: "/dashboard", label: "Overview of your interview pipeline" },
  { route: "/candidates", label: "Add and browse candidates" },
  { route: "/sessions", label: "Schedule and manage interviews" },
  { route: "/results", label: "Scored, completed interviews" },
];

/** Standalone — deliberately outside the sidebar Layout, matching this
 * project's design reference (see packages/ui's own header comment). Sits
 * as routes.tsx's one catch-all route, so it renders for both a logged-in
 * recruiter mistyping a nested path and a logged-out visitor hitting a
 * dead link — ProtectedRoute only gates the routes that actually match. */
export default function NotFound() {
  const navigate = useNavigate();

  return (
    <section className="flex min-h-screen items-center justify-center bg-background px-6 py-20">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex flex-col items-start gap-6">
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            404
          </span>
          <h1 className="text-6xl font-semibold leading-none tracking-tight text-foreground sm:text-7xl">
            Page not found.
          </h1>
          <p className="max-w-md text-base text-muted-foreground sm:text-lg">
            The page you're looking for doesn't exist — it may have moved,
            or the link might just be wrong.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Link to="/dashboard" className={buttonVariants({ size: "lg" })}>
              Go to Dashboard
            </Link>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
              )}
            >
              Go back
            </button>
          </div>

          <div className="mt-6 w-full border-t border-border pt-6">
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Try one of these
            </span>
            <ul className="mt-3 flex flex-col">
              {SUGGESTIONS.map((s) => (
                <li key={s.route}>
                  <Link
                    to={s.route}
                    className="group flex items-center justify-between gap-4 border-b border-border p-3 transition-colors last:border-b-0 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex items-baseline gap-4">
                      <span className="text-sm text-foreground">
                        {s.route}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {s.label}
                      </span>
                    </div>
                    <TbArrowRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-all duration-150 ease-out group-hover:translate-x-0.5 group-hover:opacity-100" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
