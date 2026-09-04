import {Children,cloneElement,isValidElement,type ReactNode,type HTMLAttributes} from "react";

function heading(node:ReactNode):ReactNode {
  for(const child of Children.toArray(node)) {
    if(!isValidElement<{children?:ReactNode}>(child)) continue;
    if(child.type==="h2") return child;
    const found=heading(child.props.children); if(found) return found;
  }
  return null;
}
// Native details preserve controls and drafts while collapsed. Start open so
// existing tasks and links retain their behavior; users can fold each section.
export function SectionTiles({children}:{children:ReactNode}) {
  const withoutHeading=(nodes:ReactNode):ReactNode=>{
    let removed=false;
    const strip=(items:ReactNode):ReactNode=>Children.map(items,node=>{
      if(!isValidElement<{children?:ReactNode}>(node)) return node;
      if(node.type==="h2"&&!removed) {removed=true;return null;}
      return node.props.children?cloneElement(node,{},strip(node.props.children)):node;
    });
    return strip(nodes);
  };
  const walk=(nodes:ReactNode):ReactNode=>Children.map(nodes,node=>{
    if(!isValidElement<HTMLAttributes<HTMLElement>>(node)) return node;
    const title=node.type==="section" ? heading(node.props.children) : null;
    if(title) return <details {...node.props} className={`section-tile ${node.props.className??""}`} open>
      <summary>{title}</summary>{withoutHeading(node.props.children)}
    </details>;
    return node.props.children ? cloneElement(node,{},walk(node.props.children)) : node;
  });
  return <>{walk(children)}</>;
}
