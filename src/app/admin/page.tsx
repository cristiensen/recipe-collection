import { Search } from "lucide-react";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserRowActions } from "@/components/user-row-actions";
import { getUsersPage } from "@/lib/data";
import { formatDate } from "@/lib/format";
import {
  canBanUser,
  canDeleteAccount,
  canOpenDashboard,
  canSetLevel,
  LEVEL,
} from "@/lib/privileges";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Manage users" };

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminPage(props: PageProps<"/admin">) {
  const actor = await requireUser("/admin");
  if (!canOpenDashboard(actor)) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
        <h1 className="text-xl font-semibold">
          You don&apos;t have access to this page
        </h1>
        <p className="text-muted-foreground">
          The management dashboard is for moderators and admins.
        </p>
        <Button asChild>
          <Link href="/">Browse recipes</Link>
        </Button>
      </div>
    );
  }

  const params = await props.searchParams;
  const q = first(params.q) ?? "";
  const page = Math.max(1, Math.floor(Number(first(params.page))) || 1);
  const { users, total, pageCount } = await getUsersPage(q, page);
  const isAdmin = actor.level >= LEVEL.ADMIN;

  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `/admin?${qs}` : "/admin";
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Manage users
        </h1>
        <p className="mt-1 text-muted-foreground">
          {isAdmin
            ? "Change privilege levels, ban users or delete accounts."
            : "Ban or unban users. You can act on users and chefs."}
        </p>
      </div>

      <Form action="/admin" className="flex max-w-md gap-2" role="search">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Search by name or email"
          aria-label="Search users"
        />
        <Button type="submit" variant="secondary">
          <Search aria-hidden /> Search
        </Button>
      </Form>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {total} {total === 1 ? "account" : "accounts"}
        {q && <> matching &ldquo;{q}&rdquo;</>}
      </p>

      {users.length === 0 ? (
        <p className="rounded-xl border border-dashed py-12 text-center text-muted-foreground">
          No accounts found.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">
                  User
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Activity
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Joined
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Level &amp; actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u) => {
                const target = { id: u.id, level: u.privilegeLevel };
                return (
                  <tr key={u.id} data-testid={`user-row-${u.email}`}>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2 font-medium">
                        {u.name}
                        {u.id === actor.id && (
                          <Badge variant="secondary">You</Badge>
                        )}
                        {u.bannedAt && (
                          <Badge variant="destructive">Banned</Badge>
                        )}
                      </div>
                      <div className="text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {u._count.recipes} recipes · {u._count.reviews} reviews
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(u.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <UserRowActions
                        user={{
                          id: u.id,
                          name: u.name,
                          level: u.privilegeLevel,
                          banned: u.bannedAt !== null,
                        }}
                        canSetLevel={canSetLevel(actor, target, LEVEL.USER)}
                        canBan={canBanUser(actor, target)}
                        canDelete={canDeleteAccount(actor, target)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 && (
        <nav
          aria-label="Pagination"
          className="flex items-center justify-center gap-3"
        >
          {page > 1 && (
            <Button asChild variant="outline">
              <Link href={pageHref(page - 1)}>Previous</Link>
            </Button>
          )}
          <span className="text-sm text-muted-foreground">
            Page {page} of {pageCount}
          </span>
          {page < pageCount && (
            <Button asChild variant="outline">
              <Link href={pageHref(page + 1)}>Next</Link>
            </Button>
          )}
        </nav>
      )}
    </div>
  );
}
