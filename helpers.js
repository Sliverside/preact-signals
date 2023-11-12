function wrapElement(element, wrapper) {
  if (!isNode(wrapper) || !isNode(element)) return false;

  const nextEl = element.nextElementSibling;
  const parent = element.parentElement;

  if (!nextEl && !parent) return false;

  wrapper.appendChild(element);

  if (nextEl) nextEl.before(wrapper);
  else parent.appendChild(wrapper);
}

function isNode(o) {
  return (
    typeof Node === "object" ? o instanceof Node :
      o && typeof o === "object" && typeof o.nodeType === "number" && typeof o.nodeName === "string"
  );
}

function isElement(o) {
  return (
    typeof HTMLElement === "object" ? o instanceof HTMLElement : //DOM2
      o && typeof o === "object" && o !== null && o.nodeType === 1 && typeof o.nodeName === "string"
  );
}
/**
 * @param {string} tag - TagName of the new element.
 * @param {Object} options
 * @param {String[]} options.classList
 * @param {Object} options.attributes
 * @param {Object} options.properties
 * @param {HTMLElement|string[]} options.children
 */
function createElement(tag, options) {
  let el = document.createElement(tag);

  if (options.classList)
    options.classList.forEach((c) => el.classList.add(c));

  if (options.attributes)
    for (let attr in options.attributes)
      el.setAttribute(attr, options.attributes[attr]);

  if (options.properties) Object.assign(el, options.properties);

  if (options.children) {
    for (let i = 0, length = options.children.length; i < length; i++) {
      const child = options.children[i];
      el.appendChild(
        typeof child === "string"
          ? document.createTextNode(child)
          : child
      );
    }
  }

  return el;
}

export {
  wrapElement,
  isNode,
  isElement,
  createElement
};
