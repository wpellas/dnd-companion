import { Fragment, type ReactNode } from 'react'

/**
 * A translated sentence with parts that are React elements (a link, bold text, `<code>`). The text marks the places with
 * `{name}` and `parts` supplies what goes there, so word order can differ between languages.
 */
export function Rich({ text, parts }: { text: string; parts: Record<string, ReactNode> }) {
  const pieces = text.split(/(\{\w+\})/g)
  return (
    <>
      {pieces.map((piece, i) => {
        const name = /^\{(\w+)\}$/.exec(piece)?.[1]
        return name && name in parts ? <Fragment key={i}>{parts[name]}</Fragment> : piece
      })}
    </>
  )
}
