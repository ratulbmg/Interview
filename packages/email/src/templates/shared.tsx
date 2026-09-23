import * as React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";
import { ReactNode } from "react";

/** Shared page chrome for all three templates — kept tiny on purpose, no
 * shared brand styling has been designed for this product yet. */
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
          fontFamily: "sans-serif",
          backgroundColor: "#f6f6f6",
          padding: "24px",
        }}
      >
        <Container
          style={{
            backgroundColor: "#ffffff",
            padding: "32px",
            borderRadius: "8px",
          }}
        >
          <Heading as="h2">{heading}</Heading>
          {children}
          <Text
            style={{ color: "#888888", fontSize: "12px", marginTop: "32px" }}
          >
            This is an automated message about an interview you've been
            scheduled for.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
