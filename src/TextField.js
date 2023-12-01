import { BaseField } from "./BaseField";

export function TextField (container) {

    if(!(this instanceof TextField)) {
        throw new Error("TextField must be called using 'new' keyword")
    }

    if(!(container instanceof HTMLElement)) {
        throw new Error("container should be an HTMLElement")
    }

    if(!(this instanceof TextField)) throw new Error("TextField must be called using 'new' keyword")

    this.baseField = undefined
    this.input = undefined

    this.init = function() {
        this.input = container.querySelector('input.field__input, textarea.field__input')

        if(
            (!(this.input instanceof HTMLInputElement) || ['radio', 'checkbox'].includes(this.input.type))
            && !(this.input instanceof HTMLTextAreaElement)
        ) {
            throw new Error("the container should contains a 'input.field__input' element with a type not equal to radio or checkbox")
        }

        this.baseField = new BaseField(container)

        const onInput = () => {
            this.baseField.value.set(this.input.value)
        }

        onInput()
        this.input.addEventListener('input', onInput)
        this.input.addEventListener('change', onInput)
    }

    this.init()
    return this.baseField
}
