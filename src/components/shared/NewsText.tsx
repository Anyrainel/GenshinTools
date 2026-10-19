import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";

/** Render inline Markdown links without interpreting HTML or other markup. */
export function NewsText({
  children,
  onNavigate,
}: {
  children: string;
  onNavigate?: () => void;
}) {
  const parts: ReactNode[] = [];
  const pattern = /\[([^[\]\n]+)\]\(([^\s()<>]+)\)/g;
  let offset = 0;
  for (const match of children.matchAll(pattern)) {
    parts.push(children.slice(offset, match.index));
    const [source, label, href] = match;
    const className =
      "text-primary underline underline-offset-2 hover:decoration-2 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-sm break-words";
    if (/^\/(?![\\/])/.test(href) && !href.includes("\\")) {
      parts.push(
        <Link
          key={match.index}
          to={href}
          className={className}
          onClick={onNavigate}
        >
          {label}
        </Link>
      );
    } else if (/^https?:\/\//i.test(href)) {
      parts.push(
        <a
          key={match.index}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={className}
        >
          {label}
        </a>
      );
    } else {
      parts.push(source);
    }
    offset = match.index + source.length;
  }
  parts.push(children.slice(offset));
  return <Fragment>{parts}</Fragment>;
}
