/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {AST, ASTWithSource, BindingPipe, PrefixNot, TmplAstBoundEvent, TmplAstNode,} from '@angular/compiler';
import {BoundAttribute, Template} from '@angular/compiler/src/render3/r3_ast';
import ts from 'typescript';

import {ErrorCode, ExtendedTemplateDiagnosticName} from '../../../../diagnostics';
import {NgTemplateDiagnostic} from '../../../api';
import {TemplateCheckFactory, TemplateCheckWithVisitor, TemplateContext} from '../../api';

/**
 * Ensures there is no negated async pipe in an ngIf expression.
 */
class NegatedAsyncPipeCheck extends TemplateCheckWithVisitor<ErrorCode.NEGATED_ASYNC_PIPE> {
  override code = ErrorCode.NEGATED_ASYNC_PIPE as const;

  override visitNode(
      ctx: TemplateContext<ErrorCode.NEGATED_ASYNC_PIPE>,
      component: ts.ClassDeclaration,
      node: TmplAstNode|AST,
      ): NgTemplateDiagnostic<ErrorCode.NEGATED_ASYNC_PIPE>[] {
    if (!(node instanceof Template)) return [];
    const negatedAsyncPipe = node.templateAttrs.find(
        (t): t is BoundAttribute => t.name === 'ngIf' && t.value instanceof ASTWithSource &&
            t.value.ast instanceof PrefixNot && t.value.ast.expression instanceof BindingPipe &&
            t.value.ast.expression.name === 'async',
    );
    if (!negatedAsyncPipe) return [];

    const boundSyntax = negatedAsyncPipe.sourceSpan.toString();
    const expectedBoundSyntax = boundSyntax;
    const diagnostic = ctx.makeTemplateDiagnostic(
        negatedAsyncPipe.sourceSpan,
        `An AsyncPipe should not be negated in an ngIf expression`,
    );
    return [diagnostic];
  }
}

export const factory: TemplateCheckFactory<
    ErrorCode.NEGATED_ASYNC_PIPE, ExtendedTemplateDiagnosticName.NEGATED_ASYNC_PIPE> = {
  code: ErrorCode.NEGATED_ASYNC_PIPE,
  name: ExtendedTemplateDiagnosticName.NEGATED_ASYNC_PIPE,
  create: () => new NegatedAsyncPipeCheck(),
};
