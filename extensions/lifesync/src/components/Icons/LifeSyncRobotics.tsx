import React from 'react';
import type { HTMLAttributes } from 'react';

type IconProps = HTMLAttributes<SVGElement>;

/**
 * LifeSyncRotics Logo Component
 *
 * Custom logo component to replace the default OHIF logo in the header.
 * You can customize the SVG content and text to match your branding.
 *
 * Usage:
 * In your app configuration, set:
 * whiteLabeling: {
 *   createLogoComponentFn: (React) => {
 *     return React.createElement(
 *       require('@ohif/extension-worklist/LifeSyncRobotics').default
 *     );
 *   }
 * }
 */
export const LifeSyncRobotics = (props: IconProps) => (
  <svg
    width="220px"
    height="28px"
    viewBox="0 0 220 28"
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <g
      id="LifeSyncRobotics-Logo"
      stroke="none"
      strokeWidth="1"
      fill="none"
      fillRule="evenodd"
    >
      {/* Logo Icon Area - Placeholder: 4 squares grid pattern */}
      {/* TODO: Replace with your actual logo design when available */}
      <g
        id="Logo-Icon"
        transform="translate(0, 3)"
      >
        <rect
          id="Icon-Box-1"
          x="0"
          y="0"
          width="9"
          height="9"
          rx="1"
          fill="#FFFFFF"
        />
        <rect
          id="Icon-Box-2"
          x="11"
          y="0"
          width="9"
          height="9"
          rx="1"
          fill="#FFFFFF"
        />
        <rect
          id="Icon-Box-3"
          x="0"
          y="11"
          width="9"
          height="9"
          rx="1"
          fill="#FFFFFF"
        />
        <rect
          id="Icon-Box-4"
          x="11"
          y="11"
          width="9"
          height="9"
          rx="1"
          fill="#FFFFFF"
        />
      </g>

      {/* Text Area - "LifeSyncRotics" */}
      <g
        id="Logo-Text"
        transform="translate(28, 0)"
      >
        <text
          x="0"
          y="20"
          fontSize="16"
          fontFamily="Arial, sans-serif"
          fontWeight="600"
          fill="#FFFFFF"
        >
          Asclepius SyncForge
        </text>
      </g>
    </g>
  </svg>
);

export default LifeSyncRobotics;
