/**
 * Shared React components, consumed via @repo/ui by apps/admin. The
 * design system (colors, radius scale) mirrors the Arowdox reference
 * project's — see apps/admin/src/styles/globals.css's theme tokens.
 */

export { cn } from "./utils/cn";
export { Button, type ButtonProps } from "./components/button";
export { buttonVariants } from "./components/button-variants";
export { Input } from "./components/input";
export { Select } from "./components/select";
export { Label } from "./components/label";
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "./components/card";
export { Badge, type BadgeProps } from "./components/badge";
export { badgeVariants } from "./components/badge-variants";
export { Modal, type ModalProps } from "./components/modal";
