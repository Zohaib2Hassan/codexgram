import { useState } from "react";
import { useConvexAuth, useQuery, useMutation, useAction } from "convex/react";
import { useClerk } from "@clerk/expo";
import { Redirect } from "expo-router";
import { Platform } from "react-native";
import * as Crypto from "expo-crypto";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import {
  Button,
  Card,
  Field,
  Label,
  Loading,
  Screen,
  useTask,
  ErrorText,
} from "../components/ui";
import { ProtectedMedia } from "../components/ProtectedMedia";

export default function Admin() {
  const auth = useConvexAuth();
  const me = useQuery(api.users.me, auth.isAuthenticated ? {} : "skip");
  if (Platform.OS !== "web") return <Redirect href="/" />;
  if (auth.isLoading || (auth.isAuthenticated && me === undefined))
    return <Loading />;
  if (!auth.isAuthenticated) return <Redirect href="/sign-in" />;
  if (!me?.active || !["admin", "reviewer"].includes(me.role))
    return (
      <Screen title="Private dashboard">
        <Label>Administrator access is required.</Label>
      </Screen>
    );
  return <Dashboard />;
}
function Dashboard() {
  const data = useQuery(api.admin.dashboard);
  const create = useMutation(api.admin.createInvite);
  const revoke = useMutation(api.admin.revokeInvite);
  const resolve = useAction(api.admin.resolveAppeal);
  const correct = useMutation(api.admin.resolveCorrection);
  const { signOut } = useClerk();
  const task = useTask();
  const [code, setCode] = useState("");
  const [reason, setReason] = useState("");
  if (!data) return <Loading />;
  return (
    <Screen
      title="Community desk"
      subtitle="Invitations, safety and operations"
      action={
        <Button secondary onPress={() => void signOut()}>
          Sign out
        </Button>
      }
    >
      <ErrorText text={task.error} />
      {data.role === "admin" && (
        <>
          <Controls initial={data.controls} />
          <Card>
            <Label>Invite someone</Label>
            <Label muted>
              Single-use codes expire after 7 days. Share the code privately;
              only its hash is stored.
            </Label>
            <Button
              onPress={() =>
                void task.run(async () => {
                  const value =
                    Crypto.randomUUID() + Crypto.randomUUID().slice(0, 8);
                  await create({ code: value });
                  setCode(value);
                })
              }
            >
              Generate invitation
            </Button>
            {code && (
              <Field
                label="New code — copy now"
                value={code}
                editable={false}
              />
            )}
            {data.invitations.map((i) => (
              <Card key={i._id}>
                <Label muted>
                  {new Date(i._creationTime).toLocaleDateString()} ·{" "}
                  {i.usedBy ? "Redeemed" : i.revoked ? "Revoked" : "Available"}
                </Label>
                {!i.usedBy && !i.revoked && (
                  <Button
                    secondary
                    onPress={() => void task.run(() => revoke({ id: i._id }))}
                  >
                    Revoke
                  </Button>
                )}
              </Card>
            ))}
          </Card>
        </>
      )}
      <Label large>Reports</Label>
      <Label muted>
        Cases involving you are excluded. Do not paste sensitive evidence into
        logs or external tools.
      </Label>
      {data.reports.map((r) => (
        <ReportCase key={r._id} report={r} />
      ))}
      <Label large>Appeals</Label>
      <Field
        label="Review explanation (required)"
        multiline
        value={reason}
        onChangeText={setReason}
      />
      {data.appeals.map((a) => (
        <Card key={a._id}>
          <Label>{a.text}</Label>
          <Label muted>
            {a.action.action}: {a.action.reason}
          </Label>
          <Label>{a.status}</Label>
          {a.status === "open" && (
            <>
              <Button
                secondary
                onPress={() =>
                  void task.run(() =>
                    resolve({ id: a._id, reverse: false, reason }),
                  )
                }
              >
                Uphold decision
              </Button>
              <Button
                onPress={() =>
                  void task.run(() =>
                    resolve({ id: a._id, reverse: true, reason }),
                  )
                }
              >
                Reverse decision
              </Button>
            </>
          )}
        </Card>
      ))}
      {data.role === "admin" && (
        <>
          <Label large>Birth-date corrections</Label>
          {data.corrections.map((c) => (
            <Card key={c._id}>
              <Label>{c.birthDate}</Label>
              <Label muted>{c.reason}</Label>
              {c.status === "open" && (
                <>
                  <Button
                    onPress={() =>
                      void task.run(() =>
                        correct({ id: c._id, approve: true, reason }),
                      )
                    }
                  >
                    Approve verified correction
                  </Button>
                  <Button
                    secondary
                    onPress={() =>
                      void task.run(() =>
                        correct({ id: c._id, approve: false, reason }),
                      )
                    }
                  >
                    Reject correction
                  </Button>
                </>
              )}
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}
function ReportCase({ report: r }: { report: Doc<"reports"> }) {
  const review = useMutation(api.admin.review);
  const reinstate = useMutation(api.admin.reinstate);
  const task = useTask();
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("7");
  return (
    <Card>
      <Label>
        {r.target.kind} · {r.status}
      </Label>
      <Label>{r.reason}</Label>
      <Label muted>{r.evidenceText}</Label>
      {r.evidenceStorageId && (
        <ProtectedMedia
          evidence
          id={r._id}
          kind={r.evidenceMime?.startsWith("video") ? "video" : "image"}
          visible={false}
        />
      )}
      <Field
        label="Decision explanation"
        value={reason}
        onChangeText={setReason}
      />
      <Field
        label="Suspension days (blank = indefinite)"
        value={days}
        onChangeText={setDays}
        keyboardType="numeric"
      />
      {r.status === "open" && (
        <>
          <Button
            secondary
            onPress={() =>
              void task.run(() =>
                review({ id: r._id, decision: "dismiss", reason }),
              )
            }
          >
            Dismiss report
          </Button>
          {r.target.kind !== "user" && (
            <Button
              secondary
              onPress={() =>
                void task.run(() =>
                  review({ id: r._id, decision: "remove", reason }),
                )
              }
            >
              Remove reported content
            </Button>
          )}
          <Button
            danger
            onPress={() =>
              void task.run(() =>
                review({
                  id: r._id,
                  decision: "suspend",
                  reason,
                  ...(days.trim()
                    ? { suspensionUntil: Date.now() + Number(days) * 86400000 }
                    : {}),
                }),
              )
            }
          >
            Suspend account
          </Button>
        </>
      )}
      <Button
        secondary
        onPress={() =>
          void task.run(() => reinstate({ id: r.subject, reason }))
        }
      >
        Reinstate account
      </Button>
      <ErrorText text={task.error} />
    </Card>
  );
}
function Controls({
  initial,
}: {
  initial: {
    invitationsPaused: boolean;
    uploadsPaused: boolean;
    mediaPaused: boolean;
    estimatedMonthlyUsd: number;
    userCap: number;
  };
}) {
  const [value, setValue] = useState(initial);
  const save = useMutation(api.admin.setControls);
  const task = useTask();
  return (
    <Card>
      <Label>Operating controls</Label>
      <Label muted>
        US$25/month ceiling. Enter combined provider usage estimates. This
        dashboard is not a provider billing cap; verify provider controls before
        launch.
      </Label>
      <Field
        label="Estimated monthly cost (USD)"
        keyboardType="decimal-pad"
        value={String(value.estimatedMonthlyUsd)}
        onChangeText={(v) =>
          setValue((p) => ({ ...p, estimatedMonthlyUsd: Number(v) }))
        }
      />
      <Field
        label="Admission cap (1–500)"
        keyboardType="numeric"
        value={String(value.userCap)}
        onChangeText={(v) => setValue((p) => ({ ...p, userCap: Number(v) }))}
      />
      {(["invitationsPaused", "uploadsPaused", "mediaPaused"] as const).map(
        (key) => (
          <Button
            key={key}
            secondary
            onPress={() => setValue((p) => ({ ...p, [key]: !p[key] }))}
          >{`${key}: ${value[key] ? "paused" : "available"}`}</Button>
        ),
      )}
      <Button onPress={() => void task.run(() => save(value))}>
        Apply controls
      </Button>
      <ErrorText text={task.error} />
    </Card>
  );
}
