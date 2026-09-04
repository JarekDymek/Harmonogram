import {Children,cloneElement,isValidElement,type ReactNode} from "react";
import {LEGAL_SOURCE,RULE_HELP,ruleRisk} from "../ruleHelp";
function fieldName(nodes:ReactNode):string|undefined {
 for(const node of Children.toArray(nodes)) {
  if(!isValidElement<{name?:string;children?:ReactNode}>(node)) continue;
  if(node.props.name) return node.props.name;
  const found=fieldName(node.props.children); if(found) return found;
 }
}
export function RuleFields({children,values}:{children:ReactNode;values:Record<string,unknown>}) {
 const walk=(nodes:ReactNode):ReactNode=>Children.map(nodes,node=>{
  if(!isValidElement<{children?:ReactNode;className?:string}>(node)) return node;
  if(node.type==="label") {
   const name=fieldName(node.props.children), help=name&&RULE_HELP[name];
   if(!help) return node;
   const risk=ruleRisk(name,values[name]);
   return <div className={`rule-field ${node.props.className??""}${risk?" rule-field--risk":""}`}>
    {node}{risk&&<p role="status" className="rule-risk">{risk} Pole pozostaje edytowalne.</p>}
    <details className="rule-hint"><summary>Co zmienia ta reguła?</summary><strong>{help[0]}</strong><p>{help[1]}</p>
    {help[0].includes("prawo")&&<a href={LEGAL_SOURCE} target="_blank" rel="noreferrer">Ogólne normy — Państwowa Inspekcja Pracy</a>}</details>
   </div>;
  }
  return node.props.children?cloneElement(node,{},walk(node.props.children)):node;
 });
 return <>{walk(children)}</>;
}
