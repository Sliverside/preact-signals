import { signal, effect } from "@preact/signals-core";
import { BaseField } from "./BaseField";
import { createElement } from "./helpers";

export function SelectField(container) {
    this.container = undefined
    this.baseField = undefined
    this.select = undefined
    this.multiple = undefined
    this.options = undefined
    this.selected = undefined
    this.isOpen = undefined

    this.init = function () {
        this.container = container
        this.select = this.container.querySelector('select.field__input')

        if (!(this.select instanceof HTMLSelectElement)) {
            throw new Error("the container should contains a 'input.field__input' element with a type not equal to radio or checkbox")
        }

        this.baseField = new BaseField(this.container)
        this.isOpen = signal(true)
        this.selected = signal([])
        this.options = signal([
            {
                "label": "test"
            }
        ])

        const selectedDisplay = createElement('div', {
            classList: ['field__selected'],
            children: [' ']
        })

        const optionsContainer = createElement('div', {
            classList: ['field__options', this.select.multiple ? 'multiple' : 'simple']
        })

        this.container.appendChild(selectedDisplay)
        this.container.appendChild(optionsContainer)
        this.select.style.display = "none"

        effect(() => this.container.classList.toggle('isOpen', this.isOpen.value))

        effect(() => {
            optionsContainer.innerHTML = ""
            for (let i = 0; i < this.options.value.length; i++) {
                const option = this.options.value[i]

                const classList = ['field__option']
                if (this.selected.value.includes(i)) classList.push('isSelected')
                //   if (this.select.multiple && i === this.navIndex.value) classList.push('isActive')

                const optionElement = createElement('div', {
                    classList: classList,
                    children: [option.label],
                })

                optionElement.addEventListener('click', e => {
                    e.preventDefault()
                    this.toggleOption(i)
                    if (!this.select.multiple) this.isOpen.value = false
                })

                optionsContainer.appendChild(optionElement)

            }
        })
    }

    this.init()
    return this.baseField
}