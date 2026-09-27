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
 * the same palette instead of re-guessing colors per file. */
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
      <Head />
      <Preview>{previewText}</Preview>
      <Body
        style={{
          fontFamily: emailTheme.fontFamily,
          backgroundColor: emailTheme.background,
          padding: "24px",
          margin: 0,
        }}
      >
        <Container
          style={{
            backgroundColor: emailTheme.card,
            border: `1px solid ${emailTheme.border}`,
            borderRadius: "10px",
            padding: "32px",
            maxWidth: "480px",
          }}
        >
          <Text
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
            style={{ fontSize: "14px", lineHeight: "22px", color: emailTheme.foreground }}
          >
            {children}
          </Section>

          <Hr
            style={{
              borderColor: emailTheme.border,
              margin: "28px 0 16px",
            }}
          />
          <Text
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
