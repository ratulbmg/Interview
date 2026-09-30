import * as React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { ReactNode } from "react";

/** Same neutral design language as apps/admin (see its globals.css) —
 * translated to hex, since email clients don't reliably support CSS
 * variables or oklch(). Kept as one object so every template pulls from
 * the same palette instead of re-guessing colors per file. This is the
 * light-mode palette and doubles as the inline-style fallback for clients
 * that ignore the dark-mode <style> block below entirely — see
 * emailThemeDark and DARK_MODE_STYLE for the other half. */
export const emailTheme = {
  background: "#f5f5f5", // admin's --secondary
  card: "#ffffff", // --card
  foreground: "#171717", // --foreground
  mutedForeground: "#737373", // --muted-foreground
  border: "#e5e5e5", // --border
  primary: "#1a1a1a", // --primary
  primaryForeground: "#fafafa", // --primary-foreground
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

/** apps/admin itself has no dark mode wired up yet (see its globals.css's
 * own comment), so there's no real dark palette to mirror — this is a
 * from-scratch dark equivalent of emailTheme above, following the same
 * neutral/grayscale convention (primary/primaryForeground invert in dark
 * mode, same as most dark themes built on this token shape). Email clients
 * have their own independent dark-mode setting regardless of whether the
 * web app ever gets one, so this doesn't depend on that happening. */
export const emailThemeDark = {
  background: "#0a0a0a",
  card: "#171717",
  foreground: "#fafafa",
  mutedForeground: "#a1a1a1",
  border: "#2e2e2e",
  primary: "#fafafa",
  primaryForeground: "#171717",
};

/**
 * The "bulletproof email dark mode" pattern: every element below carries
 * BOTH an inline style (emailTheme, light) AND a class name this <style>
 * block overrides with `!important` inside a prefers-color-scheme query.
 * Inline styles always win over <style> rules at equal specificity, which
 * is exactly the point — a client that strips <style> blocks entirely
 * (some older ones) still renders correctly in light mode; a client that
 * honors prefers-color-scheme (Apple Mail, modern Gmail, Outlook.com, most
 * others as of a few years ago) gets the dark palette instead. The
 * color-scheme/supported-color-schemes meta tags in EmailShell are what
 * tell capable clients this email declares support for both explicitly,
 * rather than applying their own automatic (often ugly) re-coloring
 * heuristic on top of an email that never opted in.
 */
const DARK_MODE_STYLE = `
@media (prefers-color-scheme: dark) {
  .email-body { background-color: ${emailThemeDark.background} !important; }
  .email-container {
    background-color: ${emailThemeDark.card} !important;
    border-color: ${emailThemeDark.border} !important;
  }
  .email-label { color: ${emailThemeDark.mutedForeground} !important; }
  .email-heading { color: ${emailThemeDark.foreground} !important; }
  .email-section { color: ${emailThemeDark.foreground} !important; }
  .email-hr { border-color: ${emailThemeDark.border} !important; }
  .email-footer { color: ${emailThemeDark.mutedForeground} !important; }
  .email-button {
    background-color: ${emailThemeDark.primary} !important;
    color: ${emailThemeDark.primaryForeground} !important;
  }
  .email-muted-text { color: ${emailThemeDark.mutedForeground} !important; }
}
`;

/** Shared page chrome for all four templates. */
export function EmailShell({
  previewText,
  heading,
  children,
}: {
  previewText: string;
  heading: string;
  children: ReactNode;
}) {
  return (
    <Html>
      <Head>
        {/* Tells capable clients this email explicitly supports both
            schemes, so they use DARK_MODE_STYLE below instead of an
            automatic re-coloring heuristic. */}
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style>{DARK_MODE_STYLE}</style>
      </Head>
      <Preview>{previewText}</Preview>
      <Body
        className="email-body"
        style={{
          fontFamily: emailTheme.fontFamily,
          backgroundColor: emailTheme.background,
          padding: "24px",
          margin: 0,
        }}
      >
        <Container
          className="email-container"
          style={{
            backgroundColor: emailTheme.card,
            border: `1px solid ${emailTheme.border}`,
            borderRadius: "10px",
            padding: "32px",
            maxWidth: "480px",
          }}
        >
          <Text
            className="email-label"
            style={{
              fontSize: "13px",
              fontWeight: 600,
              letterSpacing: "0.02em",
              color: emailTheme.mutedForeground,
              margin: "0 0 20px",
            }}
          >
            INTERVIEW PLATFORM
          </Text>

          <Heading
            as="h2"
            className="email-heading"
            style={{
              fontSize: "20px",
              fontWeight: 600,
              color: emailTheme.foreground,
              margin: "0 0 16px",
            }}
          >
            {heading}
          </Heading>

          <Section
            className="email-section"
            style={{ fontSize: "14px", lineHeight: "22px", color: emailTheme.foreground }}
          >
            {children}
          </Section>

          <Hr
            className="email-hr"
            style={{
              borderColor: emailTheme.border,
              margin: "28px 0 16px",
            }}
          />
          <Text
            className="email-footer"
            style={{
              color: emailTheme.mutedForeground,
              fontSize: "12px",
              lineHeight: "18px",
              margin: 0,
            }}
          >
            This is an automated message about an interview you've been
            scheduled for.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
