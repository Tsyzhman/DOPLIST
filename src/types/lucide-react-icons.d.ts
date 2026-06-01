declare module "lucide-react/dist/esm/icons/*.mjs" {
  import type { ComponentType, SVGProps } from "react";

  type LucideIconProps = SVGProps<SVGSVGElement> & {
    absoluteStrokeWidth?: boolean;
    size?: number | string;
  };

  const icon: ComponentType<LucideIconProps>;
  export default icon;
}
