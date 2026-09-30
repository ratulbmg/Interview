import { useListUsersQuery } from "../../redux/api/usersApi";

/**
 * Every recruiter account on the platform — read-only, no add/edit/delete
 * here. There's no admin/non-admin distinction yet (see packages/db's
 * User model), so any logged-in recruiter can see this list; it never
 * shows a password hash, only what each recruiter has created.
 */
export default function Users() {
  const { data: users, isLoading, isError } = useListUsersQuery();

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-foreground">Users</h1>
        <p className="text-sm text-muted-foreground">
          Every recruiter account on this platform.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : isError ? (
        <p className="rounded-lg border border-dashed border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Could not load users.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Candidates</th>
                <th className="px-4 py-3 font-medium">Roles</th>
                <th className="px-4 py-3 font-medium">Questions</th>
                <th className="px-4 py-3 font-medium">Sessions</th>
                <th className="px-4 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users?.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3 text-foreground">{user.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {user.email}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {user.candidatesCount}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {user.rolesCount}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {user.questionsCount}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {user.sessionsCount}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {users?.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-6 text-center text-muted-foreground"
                  >
                    No users yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
