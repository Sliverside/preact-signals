import { signal, effect, computed, untracked } from "@preact/signals-core";
import { computePosition, flip, size, autoUpdate } from "@floating-ui/dom"
import { BaseField } from "./BaseField";
import { createElement, removeDiacritics } from "./helpers";

export function SelectField(container) {

    if (!(this instanceof SelectField)) throw new Error("SelectField must be called using 'new' keyword")

    this.container = undefined
    this.baseField = undefined
    this.select = undefined
    this.options = undefined
    this.isOpen = undefined
    this.navIndex = undefined
    this.isNavigating = undefined
    this.optionsElements = {}
    this.selectedDisplay = undefined
    this.optionsContainer = undefined
    this.typedTextTimoutId = undefined
    this.lastTypedText = ""

    this.init = function () {
        this.container = container
        this.select = this.container.querySelector('select.field__input')

        if (!(this.select instanceof HTMLSelectElement)) {
            throw new Error("the container should contains a 'input.field__input' element with a type not equal to radio or checkbox")
        }

        this.baseField = new BaseField(this.container)
        this.baseField.value = []
        this.isOpen = signal(false)
        this.navIndex = signal(0)
        this.isNavigating = signal(true)
        this.options = signal([])

        const optionsIds = computed(() => this.options.value.map(option => option.id))
        const nativeOptions = {}

        this.selectedDisplay = createElement('div', {
            classList: ['field__selected'],
            children: [' ']
        })

        this.optionsContainer = createElement('div', {
            classList: ['field__options', this.select.multiple ? 'multiple' : 'simple']
        })

        this.container.tabIndex = 0

        this.container.addEventListener('focus', () => {
            this.baseField.isFocus = true
        }, false)

        this.container.addEventListener('blur', () => {
            this.baseField.isFocus = false
            this.isOpen.value = false
        }, false)

        this.container.addEventListener('pointerdown', e => {
            if (this.optionsContainer.contains(e.target)) return
            this.baseField.isFocus = true
            this.isOpen.value = !this.isOpen.value
        }, false)

        this.container.addEventListener('keydown', this.onKeydown)

        const onOptionsContainerMouseMove = () => { this.isNavigating.value = false }

        this.isNavigating.subscribe(value => {
            if (value) this.optionsContainer.addEventListener('mousemove', onOptionsContainerMouseMove, { passive: true })
            else this.optionsContainer.removeEventListener('mousemove', onOptionsContainerMouseMove)
            this.optionsContainer.classList.toggle('isNavigating', this.isNavigating.value)
            this.optionsContainer.classList.toggle('isNotNavigating', !this.isNavigating.value)
        })

        const tempOptions = []
        for (let i = 0; i < this.select.options.length; i++) {
            const nativeOption = this.select.options[i];
            const option = this.createOption({
                label: nativeOption.textContent,
                value: nativeOption.value
            })

            tempOptions.push(option)
            nativeOptions[option.id] = nativeOption
        }

        this.options.value = tempOptions

        this.container.appendChild(this.selectedDisplay)
        this.container.appendChild(this.optionsContainer)
        this.select.style.display = "none"

        let autoUpdateCleanup

        this.isOpen.subscribe(() => {
            this.container.classList.toggle('isOpen', this.isOpen.value)

            if (typeof autoUpdateCleanup === "function") {
                autoUpdateCleanup()
                autoUpdateCleanup = undefined
            }

            if (this.isOpen.value) {
                autoUpdateCleanup = autoUpdate(
                    this.container,
                    this.optionsContainer,
                    this.computeOptionsContainerPosition
                )
            }
        })

        effect(() => {
            const displayValue = this.renderSelectedDisplay()
            this.selectedDisplay.innerHTML = displayValue === "" ? "&nbsp;" : displayValue
            this.selectedDisplay.title = displayValue
        })

        effect(() => {
            this.optionsContainer.textContent = ""
            for (let i = 0; i < optionsIds.value.length; i++) {
                const optionId = optionsIds.value[i];
                const optionElement = untracked(() => this.createOptionElement(optionId))

                this.optionsContainer.appendChild(optionElement)
            }
        })
    }

    this.createOptionElement = function (optionId) {

        const option = this.options.value[optionId]

        if (!option) return

        if (this.optionsElements[option.id]) return this.optionsElements[option.id]

        const optionElement = createElement('div', {
            classList: ['field__option'],
            children: [option.label],
        })

        effect(() => {
            const isSelected = this.baseField.value.includes(option.id)
            optionElement.classList.toggle('isSelected', isSelected)
            if (isSelected && !this.select.multiple) this.scrolloptionElementIntoView(optionElement)
        })
        effect(() => {
            const isActiveOption = this.select.multiple && option.id === this.navIndex.value
            optionElement.classList.toggle('isActive', isActiveOption)

            if (isActiveOption && this.select.multiple) this.scrolloptionElementIntoView(optionElement)
        })

        optionElement.addEventListener('click', e => {
            e.preventDefault()
            this.toggleOption(option.id)
            if (!this.select.multiple) this.isOpen.value = false
        })

        return optionElement
    }

    this.createOption = function ({ label, value, id, selected, nativeOption }) {
        if (!id && typeof id !== "number") id = this.uid.get()
        if (typeof id !== "number" && typeof id !== "string") throw new Error('id must be a string, a number or a "falsy" value')

        return { id, label, value }
    }

    this.onKeydown = e => {

        if (!this.isOpen.value && [" ", "Enter", "ArrowDown", "ArrowUp"].includes(e.key)) {
            e.preventDefault()
            this.isOpen.value = true
            return
        } else if (this.isOpen.value && ["Escape", "Tab"].includes(e.key)) {
            e.preventDefault()
            this.isOpen.value = false
            return
        }

        if ([" ", "Enter"].includes(e.key)) {
            e.preventDefault()
            if (this.select.multiple) {
                this.toggleOption(this.navIndex.value)
            } else {
                this.isOpen.value = false
            }
        } else if (["ArrowDown", "ArrowUp"].includes(e.key)) {
            e.preventDefault()
            this.isNavigating.value = true

            let currentIndex = undefined

            currentIndex = this.baseField.value[this.baseField.value.length - 1]

            if (this.select.multiple) currentIndex = this.navIndex.value

            if (typeof currentIndex === "undefined") {
                currentIndex = 0
            } else {
                if (e.key === "ArrowUp") currentIndex--
                else if (e.key === "ArrowDown") currentIndex++
                if (currentIndex < 0) currentIndex = this.select.options.length - 1
                else if (currentIndex > this.select.options.length - 1) currentIndex = 0
            }

            if (this.select.multiple) this.navIndex.value = currentIndex
            else this.selectOption(currentIndex)
        } else if (e.key.length === 1) {

            if(this.select.multiple) this.isOpen.value = true

            this.isNavigating.value = true
            this.lastTypedText += e.key

            const findedOption = this.findFirstMatchingOption(this.lastTypedText)

            if (findedOption && typeof findedOption.index === "number") {
                if (this.select.multiple) this.navIndex.value = findedOption.index
                else this.selectOption(findedOption.index)
            }

            if (this.typedTextTimoutId) {
                clearTimeout(this.typedTextTimoutId)
                this.typedTextTimoutId = undefined
            }

            this.typedTextTimoutId = setTimeout(() => {
                this.lastTypedText = ""
            }, 700);
        }
    }

    this.findFirstMatchingOption = function (query) {
        query = removeDiacritics(query.trim().toLowerCase())
        const length = query.length
        for (let i = 0; i < this.options.value.length; i++) {
            const option = this.options.value[i];
            const valueToCompare = removeDiacritics(option.label.trim().substring(0, length).toLowerCase())
            if (valueToCompare === query) return { option, index: i }
        }

        return null
    }

    this.scrolloptionElementIntoView = function (optionElement) {

        const st = this.optionsContainer.scrollTop
        const top = optionElement.offsetTop
        const bottom = optionElement.offsetTop + optionElement.offsetHeight - this.optionsContainer.offsetHeight

        if(st <= top && st >= bottom) return

        this.optionsContainer.scrollTop = st > top ? top : bottom
    }

    this.toggleOption = function (id) {
        if (this.baseField.value.includes(id)) this.deselectOption(id)
        else this.selectOption(id)
    }

    this.selectOption = function (id) {
        if (this.baseField.value.includes(id)) return
        if (this.select.multiple) this.baseField.value = [...this.baseField.value, id]
        else this.baseField.value = [id]
    }

    this.deselectOption = function (id) {
        if (!this.baseField.value.includes(id)) return
        this.baseField.value = this.baseField.value.filter((value) => value !== id)
    }

    this.renderSelectedDisplay = function () {
        if (!this.baseField.value.length === 0) return ""
        return this.baseField.value.reduce((acc, curr) => {
            const option = this.options.value[curr]
            if (option) acc.push(option.label)
            return acc
        }, []).join(', ')
    }

    this.computeOptionsContainerPosition = () => {
        computePosition(this.container, this.optionsContainer, {
            placement: 'bottom-start',
            middleware: [
                flip({
                     padding: 10,
                     crossAxis: false
                    }),
                size({
                    padding: 10,
                    apply({ availableWidth, availableHeight, elements }) {
                        Object.assign(elements.floating.style, {
                            maxWidth: `${availableWidth}px`,
                            maxHeight: `${availableHeight}px`
                        });
                    }
                })
            ]
        }).then(({ x, y }) => {
            Object.assign(this.optionsContainer.style, {
                left: `${x}px`,
                top: `${y}px`,
            });
        })
    }

    this.uid = (function () {
        let id = 0

        return {
            get: () => id++,
            reset: () => { id = 0 }
        }
    })();

    this.init()
    return this.baseField
}
