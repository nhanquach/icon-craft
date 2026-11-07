/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * IconCraft — Accessible, Type-Safe React Icon Component
 */

import type { SVGProps } from 'react';
import type { IconName } from './icon.types';

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  /**
   * The unique identifier of the icon, guaranteed type-safe by IconCraft.
   */
  name: IconName;
  /**
   * Explicit width & height of the icon (defaults to 20px).
   * Can be overridden or styled with Tailwind sizing classes (e.g. `w-5 h-5`).
   */
  size?: number | string;
  /**
   * Optional accessible title. When provided, automatically switches the role
   * to `img` and injects a `<title>` tag for screen readers.
   */
  title?: string;
  /**
   * Optional sprite path override (defaults to `/sprite.svg`).
   */
  spriteUrl?: string;
}

export function Icon({
  name,
  size = 20,
  title,
  className = '',
  spriteUrl = '/sprite.svg',
  ...props
}: IconProps) {
  const isAccessible = Boolean(title);

  return (
    <svg
      width={size}
      height={size}
      className={`inline-block shrink-0 align-middle ${className}`}
      aria-hidden={isAccessible ? undefined : 'true'}
      role={isAccessible ? 'img' : undefined}
      focusable="false"
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <use href={`${spriteUrl}#icon-${name}`} />
    </svg>
  );
}

export default Icon;
