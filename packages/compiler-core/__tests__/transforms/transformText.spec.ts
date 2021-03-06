import {
  CompilerOptions,
  parse,
  transform,
  NodeTypes,
  generate
} from '../../src'
import { transformText } from '../../src/transforms/transformText'
import { transformExpression } from '../../src/transforms/transformExpression'
import { transformElement } from '../../src/transforms/transformElement'
import { CREATE_VNODE, TEXT } from '../../src/runtimeHelpers'
import { genFlagText } from '../testUtils'
import { PatchFlags } from '@vue/shared'

function transformWithTextOpt(template: string, options: CompilerOptions = {}) {
  const ast = parse(template)
  transform(ast, {
    nodeTransforms: [
      ...(options.prefixIdentifiers ? [transformExpression] : []),
      transformText,
      transformElement
    ],
    ...options
  })
  return ast
}

describe('compiler: transform text', () => {
  test('no consecutive text', () => {
    const root = transformWithTextOpt(`{{ foo }}`)
    expect(root.children[0]).toMatchObject({
      type: NodeTypes.INTERPOLATION,
      content: {
        content: `foo`
      }
    })
    expect(generate(root).code).toMatchSnapshot()
  })

  test('consecutive text', () => {
    const root = transformWithTextOpt(`{{ foo }} bar {{ baz }}`)
    expect(root.children.length).toBe(1)
    expect(root.children[0]).toMatchObject({
      type: NodeTypes.COMPOUND_EXPRESSION,
      children: [
        { type: NodeTypes.INTERPOLATION, content: { content: `foo` } },
        ` + `,
        { type: NodeTypes.TEXT, content: ` bar ` },
        ` + `,
        { type: NodeTypes.INTERPOLATION, content: { content: `baz` } }
      ]
    })
    expect(generate(root).code).toMatchSnapshot()
  })

  test('consecutive text between elements', () => {
    const root = transformWithTextOpt(`<div/>{{ foo }} bar {{ baz }}<div/>`)
    expect(root.children.length).toBe(3)
    expect(root.children[0].type).toBe(NodeTypes.ELEMENT)
    expect(root.children[1]).toMatchObject({
      // when mixed with elements, should convert it into a text node call
      type: NodeTypes.TEXT_CALL,
      codegenNode: {
        type: NodeTypes.JS_CALL_EXPRESSION,
        callee: CREATE_VNODE,
        arguments: [
          TEXT,
          `null`,
          {
            type: NodeTypes.COMPOUND_EXPRESSION,
            children: [
              { type: NodeTypes.INTERPOLATION, content: { content: `foo` } },
              ` + `,
              { type: NodeTypes.TEXT, content: ` bar ` },
              ` + `,
              { type: NodeTypes.INTERPOLATION, content: { content: `baz` } }
            ]
          },
          genFlagText(PatchFlags.TEXT)
        ]
      }
    })
    expect(root.children[2].type).toBe(NodeTypes.ELEMENT)
    expect(generate(root).code).toMatchSnapshot()
  })

  test('text between elements (static)', () => {
    const root = transformWithTextOpt(`<div/>hello<div/>`)
    expect(root.children.length).toBe(3)
    expect(root.children[0].type).toBe(NodeTypes.ELEMENT)
    expect(root.children[1]).toMatchObject({
      // when mixed with elements, should convert it into a text node call
      type: NodeTypes.TEXT_CALL,
      codegenNode: {
        type: NodeTypes.JS_CALL_EXPRESSION,
        callee: CREATE_VNODE,
        arguments: [
          TEXT,
          `null`,
          {
            type: NodeTypes.TEXT,
            content: `hello`
          }
          // should have no flag
        ]
      }
    })
    expect(root.children[2].type).toBe(NodeTypes.ELEMENT)
    expect(generate(root).code).toMatchSnapshot()
  })

  test('consecutive text mixed with elements', () => {
    const root = transformWithTextOpt(
      `<div/>{{ foo }} bar {{ baz }}<div/>hello<div/>`
    )
    expect(root.children.length).toBe(5)
    expect(root.children[0].type).toBe(NodeTypes.ELEMENT)
    expect(root.children[1]).toMatchObject({
      type: NodeTypes.TEXT_CALL,
      codegenNode: {
        type: NodeTypes.JS_CALL_EXPRESSION,
        callee: CREATE_VNODE,
        arguments: [
          TEXT,
          `null`,
          {
            type: NodeTypes.COMPOUND_EXPRESSION,
            children: [
              { type: NodeTypes.INTERPOLATION, content: { content: `foo` } },
              ` + `,
              { type: NodeTypes.TEXT, content: ` bar ` },
              ` + `,
              { type: NodeTypes.INTERPOLATION, content: { content: `baz` } }
            ]
          },
          genFlagText(PatchFlags.TEXT)
        ]
      }
    })
    expect(root.children[2].type).toBe(NodeTypes.ELEMENT)
    expect(root.children[3]).toMatchObject({
      type: NodeTypes.TEXT_CALL,
      codegenNode: {
        type: NodeTypes.JS_CALL_EXPRESSION,
        callee: CREATE_VNODE,
        arguments: [
          TEXT,
          `null`,
          {
            type: NodeTypes.TEXT,
            content: `hello`
          }
        ]
      }
    })
    expect(root.children[4].type).toBe(NodeTypes.ELEMENT)
    expect(generate(root).code).toMatchSnapshot()
  })

  test('with prefixIdentifiers: true', () => {
    const root = transformWithTextOpt(`{{ foo }} bar {{ baz + qux }}`, {
      prefixIdentifiers: true
    })
    expect(root.children.length).toBe(1)
    expect(root.children[0]).toMatchObject({
      type: NodeTypes.COMPOUND_EXPRESSION,
      children: [
        { type: NodeTypes.INTERPOLATION, content: { content: `_ctx.foo` } },
        ` + `,
        { type: NodeTypes.TEXT, content: ` bar ` },
        ` + `,
        {
          type: NodeTypes.INTERPOLATION,
          content: {
            type: NodeTypes.COMPOUND_EXPRESSION,
            children: [{ content: `_ctx.baz` }, ` + `, { content: `_ctx.qux` }]
          }
        }
      ]
    })
    expect(
      generate(root, {
        prefixIdentifiers: true
      }).code
    ).toMatchSnapshot()
  })
})
