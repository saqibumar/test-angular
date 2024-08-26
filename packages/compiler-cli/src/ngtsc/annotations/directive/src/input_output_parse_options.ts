/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import ts from 'typescript';

import {ErrorCode, FatalDiagnosticError} from '../../../diagnostics';
import {reflectObjectLiteral} from '../../../reflection';

function checkInputForForDebugNameCase(optionsNode: ts.Expression): {alias: string | undefined} | void {
  // We are trying to detect the following pattern:
  // input(...(ngDevMode ? [{ debugName: "testInput", alias: 'alias' }] : [{ alias: 'alias' }]))

  // input(>>...<<(ngDevMode ? [{ debugName: "testInput", alias: 'alias' }] : [{ alias: 'alias' }]))
  if (!ts.isSpreadElement(optionsNode)) {
    return;
  }

  const parenthesizedExpr = optionsNode.expression;
  // input(... >>(ngDevMode ? [{ debugName: "testInput", alias: 'alias' }] : [{ alias: 'alias' }])<< )
  if (!ts.isParenthesizedExpression(parenthesizedExpr)) {
    return;
  }

  const conditionalExpr = parenthesizedExpr.expression;
  // input(...( >>ngDevMode ? [{ debugName: "testInput", alias: 'alias' }] : [{ alias: 'alias' }]<< ))
  if (!ts.isConditionalExpression(conditionalExpr)) {
    return;
  }

  const condition = conditionalExpr.condition;
  // input(...( >>ngDevMode<< ? [{ debugName: "testInput", alias: 'alias' }] : [{ alias: 'alias' }]))
  if (!ts.isIdentifier(condition)) {
    return;
  }
  const isNgDevMode = condition.text === 'ngDevMode';
  if (!isNgDevMode) {
    return;
  }

  const trueCase = conditionalExpr.whenTrue;
  const falseCase = conditionalExpr.whenFalse;
  // input(...(ngDevMode ? >>[{ debugName: "testInput", alias: 'alias' }]<< : >>[{ alias: 'alias' }]<<))
  if (!ts.isArrayLiteralExpression(trueCase) || !ts.isArrayLiteralExpression(falseCase)) {
    return;
  }
  const trueCaseElements = trueCase.elements;
  const falseCaseElements = falseCase.elements;
  // input(...(ngDevMode ? [  >>{ debugName: "testInput", alias: 'alias' }<< ] : [ >>{ alias: 'alias' }<< ]))
  if (trueCaseElements.length - 1 !== falseCaseElements.length) {
    return;
  }

  const trueCaseElement = trueCaseElements[0];
  // { debugName: "testInput", alias: 'alias' }
  if (!ts.isObjectLiteralExpression(trueCaseElement)) {
    return;
  }

  const falseCaseElement = falseCaseElements[0];
  // { alias: 'alias' }

  const trueCaseOptions = reflectObjectLiteral(trueCaseElement);
  if (falseCaseElement === undefined) {
    if (!trueCaseOptions.has('alias')) {
      return {alias: undefined};
    }

    const trueCaseAliasExpr = trueCaseOptions.get('alias')!;
    if (ts.isStringLiteralLike(trueCaseAliasExpr)) {
      return {alias: trueCaseAliasExpr.text};
    }
  } else if (ts.isObjectLiteralExpression(falseCaseElement)) {
    const falseCaseOptions = reflectObjectLiteral(falseCaseElement);
    if (!trueCaseOptions.has('alias') || !falseCaseOptions.has('alias')) {
      return;
    }

    const trueCaseAliasExpr = trueCaseOptions.get('alias')!;
    const falseCaseAliasExpr = falseCaseOptions.get('alias')!;
    if (!ts.isStringLiteralLike(trueCaseAliasExpr) || !ts.isStringLiteralLike(falseCaseAliasExpr)) {
      return;
    }

    const trueCaseAlias = trueCaseAliasExpr.text;
    const falseCaseAlias = falseCaseAliasExpr.text;
    if (trueCaseAlias !== falseCaseAlias) {
      throw new FatalDiagnosticError(
        ErrorCode.VALUE_HAS_WRONG_TYPE,
        falseCaseAliasExpr,
        'Argument needs to be an object literal that is statically analyzable',
      );
    }
    
    return {alias: trueCaseAlias};
  }
}

/**
 * Parses and validates input and output initializer function options.
 * 
 * Tries to detect the signal debugName case and returns the alias if it is found.
 * Else assumes that the options are a static object literal and parses the `alias` option and returns it.
 * The other options for signal inputs are runtime constructs that aren't relevant at compile time.
 *
 */
export function parseAndValidateInputAndOutputOptions(optionsNode: ts.Expression): {
  alias: string | undefined;
} {
  // Check for case where input is augmented with a debugName optional arg
  const inputOptionsFromDebugNameCase = checkInputForForDebugNameCase(optionsNode);
  if (inputOptionsFromDebugNameCase) {
    return inputOptionsFromDebugNameCase;
  }

  if (!ts.isObjectLiteralExpression(optionsNode)) {
    throw new FatalDiagnosticError(
      ErrorCode.VALUE_HAS_WRONG_TYPE,
      optionsNode,
      'Argument needs to be an object literal that is statically analyzable.',
    );
  }

  const options = reflectObjectLiteral(optionsNode);
  let alias: string | undefined = undefined;

  if (options.has('alias')) {
    const aliasExpr = options.get('alias')!;
    if (!ts.isStringLiteralLike(aliasExpr)) {
      throw new FatalDiagnosticError(
        ErrorCode.VALUE_HAS_WRONG_TYPE,
        aliasExpr,
        'Alias needs to be a string that is statically analyzable.',
      );
    }

    alias = aliasExpr.text;
  }

  return {alias};
}
