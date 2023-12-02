export function wrapElement(element, wrapper) {
  if (!isNode(wrapper) || !isNode(element)) return false;

  const nextEl = element.nextElementSibling;
  const parent = element.parentElement;

  if (!nextEl && !parent) return false;

  wrapper.appendChild(element);

  if (nextEl) nextEl.before(wrapper);
  else parent.appendChild(wrapper);
}

export function isNode(o) {
  return (
    typeof Node === "object" ? o instanceof Node :
      o && typeof o === "object" && typeof o.nodeType === "number" && typeof o.nodeName === "string"
  );
}

export function isElement(o) {
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
export function createElement(tag, options) {
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

export function debounce(callback, delay) {
  var timer;
  return function () {
    var args = arguments;
    var context = this;
    clearTimeout(timer);
    timer = setTimeout(function () {
      callback.apply(context, args);
    }, delay)
  }
}

export function removeDiacritics(string) {
  return string.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

export function extend(src, props) {
  for (var prop in props) {
    if (props.hasOwnProperty(prop)) {
      var val = props[prop];
      if (val && Object.prototype.toString.call(val) === "[object Object]") {
        src[prop] = src[prop] || {};
        extend(src[prop], val);
      } else {
        src[prop] = val;
      }
    }
  }
  return src;
}

export function isHidden(node) {
  // offsetParent being null will allow detecting cases where an element is invisible or inside an invisible element,
  // as long as the element does not use position: fixed. For them, their visibility has to be checked directly as well.
  return node.offsetParent === null || getComputedStyle(node).visibility === 'hidden'
}

/**
 * 
 * @param {number | string} number 
 * @param {string} [delimiter] 
 * @param {string} [decimalSeparator] 
 * @returns 
 */
export function formatNumber(number, delimiter, decimalSeparator) {
  if (typeof number === "undefined") return false;
  delimiter = typeof delimiter === 'string' ? delimiter : ' '
  decimalSeparator = typeof decimalSeparator === 'string' ? decimalSeparator : '.'

  number = parseFloat(number);
  if (isNaN(number)) return false;
  let i = 0;
  let numberFormated = "";
  const numberInteger = Math.floor(number);
  const numberIntegerStr = numberInteger.toString();
  const numberDecimals = Math.round((number * 100) - (numberInteger * 100));
  const remainder = numberIntegerStr.length % 3;

  do {
    const nbChar = (i == 0 && remainder > 0) ? remainder : 3;
    numberFormated += numberIntegerStr.substring(i, i + nbChar);
    i += nbChar;
    if (numberIntegerStr.length > i) numberFormated += " ";
  } while (i < numberIntegerStr.length);

  if (numberDecimals > 0) numberFormated += '.' + numberDecimals.toString();

  return numberFormated;
}