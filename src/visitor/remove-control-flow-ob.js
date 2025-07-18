import * as t from '@babel/types'

function handleControlFlow(path) {
  // 扁平控制：
  // 会使用一个恒为true的while语句包裹一个switch语句
  // switch语句的执行顺序由while语句上方的字符串决定
  // 首先判断是否符合这种情况
  const node = path.node
  let valid = false
  if (t.isBooleanLiteral(node.test) && node.test.value) {
    valid = true
  }
  if (t.isUnaryExpression(node.test) && node.test.prefix) {
    valid = true
  }
  if (t.isArrayExpression(node.test) && node.test.elements.length === 0) {
    valid = true
  }
  if (!valid) {
    return
  }
  if (!t.isBlockStatement(node.body)) {
    return
  }
  const body = node.body.body
  if (
    !t.isSwitchStatement(body[0]) ||
    !t.isMemberExpression(body[0].discriminant) ||
    !t.isBreakStatement(body[1])
  ) {
    return
  }
  // switch语句的两个变量
  const swithStm = body[0]
  const arrName = swithStm.discriminant.object.name
  const argName = swithStm.discriminant.property.argument.name
  // 在while上面的节点寻找这两个变量
  let arr = []
  let rm = []
  path.getAllPrevSiblings().forEach((pre_path) => {
    if (!pre_path.isVariableDeclaration()) {
      return
    }
    for (let i = 0; i < pre_path.node.declarations.length; ++i) {
      const declaration = pre_path.get(`declarations.${i}`)
      let { id, init } = declaration.node
      if (arrName == id.name) {
        if (t.isStringLiteral(init?.callee?.object)) {
          arr = init.callee.object.value.split('|')
          rm.push(declaration)
        }
      }
      if (argName == id.name) {
        if (t.isLiteral(init)) {
          rm.push(declaration)
        }
      }
    }
  })
  if (rm.length !== 2) {
    return
  }
  rm.forEach((pre_path) => {
    pre_path.remove()
  })
  console.log(`扁平化还原: ${arrName}[${argName}]`)
  // 重建代码块
  const caseList = swithStm.cases
  let resultBody = []
  arr.map((targetIdx) => {
    // 从当前序号开始直到遇到continue
    let valid = true
    targetIdx = parseInt(targetIdx)
    while (valid && targetIdx < caseList.length) {
      const targetBody = caseList[targetIdx].consequent
      const test = caseList[targetIdx].test
      if (!t.isStringLiteral(test) || parseInt(test.value) !== targetIdx) {
        console.log(`switch中出现乱序的序号: ${test.value}:${targetIdx}`)
      }
      for (let i = 0; i < targetBody.length; ++i) {
        const s = targetBody[i]
        if (t.isContinueStatement(s)) {
          valid = false
          break
        }
        if (t.isReturnStatement(s)) {
          valid = false
          resultBody.push(s)
          break
        }
        if (t.isBreakStatement(s)) {
          console.log(`switch中出现意外的break: ${arrName}[${argName}]`)
        } else {
          resultBody.push(s)
        }
      }
      targetIdx++
    }
  })
  // 替换整个while语句
  path.replaceInline(resultBody)
}

/**
 * Handle BlockStatementControlFlowFlatteningNode generated by obfuscator
 */
export default {
  WhileStatement: { exit: handleControlFlow },
}
