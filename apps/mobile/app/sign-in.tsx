import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SPACE, COLORS, RADIUS } from "../constants/theme";
import { Button, ErrorBox } from "../src/components/primitives";
import { useAuth } from "../src/auth/AuthProvider";
import { SignInForm } from "../src/features/auth/SignInForm";
import { SignUpForm } from "../src/features/auth/SignUpForm";

type Mode = "sign-in" | "sign-up";

export default function SignInScreen() {
  const { notice, status, retryProfile, signOut } = useAuth();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <Text style={styles.logo}>H</Text>
          <Text style={styles.brandName}>Healthoraa</Text>
          <Text style={styles.tagline}>
            Diet programmes, doctor consultations and wellness products.
          </Text>
        </View>

        {notice ? <ErrorBox message={notice} /> : null}

        {status === "profile-error" ? (
          <View style={styles.form}>
            <Button label="Retry account check" onPress={retryProfile} />
            <Button
              label="Sign out to switch accounts"
              variant="secondary"
              busy={signingOut}
              onPress={() => {
                setSignOutError(null);
                setSigningOut(true);
                void signOut()
                  .catch((error: unknown) => {
                    setSignOutError(
                      error instanceof Error
                        ? error.message
                        : "We could not safely sign out. Try again.",
                    );
                  })
                  .finally(() => setSigningOut(false));
              }}
            />
            {signOutError ? <ErrorBox message={signOutError} /> : null}
          </View>
        ) : (
          <>
            <View style={styles.segment} accessibilityRole="tablist">
              <Segment
                label="Sign in"
                active={mode === "sign-in"}
                onPress={() => setMode("sign-in")}
              />
              <Segment
                label="Create account"
                active={mode === "sign-up"}
                onPress={() => setMode("sign-up")}
              />
            </View>
            <View style={styles.form}>
              {mode === "sign-in" ? <SignInForm /> : <SignUpForm />}
            </View>
          </>
        )}

        <Text style={styles.legal}>
          Medical, emergency and grievance guidance is pending client and
          counsel approval.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Segment({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <View style={styles.segmentButton}>
      <Button
        label={label}
        variant={active ? "primary" : "secondary"}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        onPress={onPress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.canvas },
  content: {
    padding: SPACE.xl,
    gap: SPACE.lg,
    flexGrow: 1,
    justifyContent: "center",
  },
  brand: { alignItems: "center", gap: SPACE.sm },
  logo: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.xl,
    textAlign: "center",
    lineHeight: 56,
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.canvas,
    backgroundColor: COLORS.accentBlue,
    overflow: "hidden",
  },
  brandName: { color: COLORS.textPrimary, fontSize: 22, fontWeight: "700" },
  tagline: { color: COLORS.textSecondary, fontSize: 14, textAlign: "center" },
  segment: { flexDirection: "row", gap: SPACE.sm },
  segmentButton: { flex: 1 },
  form: { gap: SPACE.md },
  legal: {
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
});
