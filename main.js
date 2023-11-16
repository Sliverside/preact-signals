import { Signal, effect, signal, computed } from "@preact/signals-core"
import { createElement } from "./src/helpers"
import './main.scss'

/**
 * @typedef {HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement} FormElement
 */

/** @param {HTMLElement} field */
export function Field(field) {
  this.el = field
  this.input = field.querySelector('.field__input')
  this.label = field.querySelector('.field__label')
  this.isFiled = null
  this.isFocus = null

  this.init = function () {
    this.isFocus = this.createFocusSignal(this.el, false)

    if (this.input.tagName === "SELECT") {
      const select = new Select(this)
      this.selecteds = select.selecteds
      if (this.selecteds) this.isFiled = computed(() => this.selecteds.value.length > 0)
    } else {
      this.isFiled = this.createFiledSignal(this.input, false)
    }

    if (this.isFiled) effect(() => this.el.classList.toggle('isFiled', this.isFiled.value))

    // prevent loosing focus on pointerdown
    this.label.addEventListener('pointerdown', e => e.preventDefault())
    effect(() => this.el.classList.toggle('isFocus', this.isFocus.value))

    this.el.classList.add('initialized')
  }

  /**
   * @param {HTMLElement} field
   * @returns {Signal}
   * */
  this.createFocusSignal = function () {
    const isFocusSignal = signal(false)

    const onClick = () => { isFocusSignal.value = true }

    this.input.addEventListener('focusin', e => {
      if(e.target !== this.input) return
      isFocusSignal.value = true
    })
    this.input.addEventListener('focusout', e => {
      isFocusSignal.value = false
    })

    effect(() => {
      if(isFocusSignal.value) this.el.removeEventListener('click', onClick)
      else this.el.addEventListener('click', onClick)
    })

    return isFocusSignal
  }

  /**
   * @param {FormElement} input
   * @returns {Signal}
   * */
  this.createFiledSignal = function () {
    const getFiled = () => this.input.value !== ""
    const isFiled = signal(getFiled())
    const update = () => { isFiled.value = getFiled() }

    this.input.addEventListener('change', update)
    this.input.addEventListener('input', update)

    return isFiled
  }


  /**
   * @param {Field} field
   */
  const Select = function (field) {
    this.el = field.el
    this.select = field.input
    this.label = field.label
    this.navIndex = null
    this.isNavigating = null
    this.isOpen = null
    this.selecteds = null
    this.options = null

    this.selectedsDisplay = createElement('div', {
      classList: ['field__selected']
    })

    this.optionsContainer = createElement('div', {
      classList: ['field__options', this.select.multiple ? 'multiple' : 'simple']
    })

    this.el.appendChild(this.selectedsDisplay)
    this.el.appendChild(this.optionsContainer)

    this.init = function () {
      this.navIndex = signal(0)
      this.isNavigating = signal(false)
      this.isOpen = this.createSelectOpenSignal()
      this.selecteds = this.createSelectSelectedsSignal()
      this.options = this.createSelectOptionsSignal()

      this.el.addEventListener('keydown', this.navigate)

      this.selectedsDisplay.tabIndex = 0

      this.selectedsDisplay.addEventListener('click', e => {
        e.preventDefault()
        field.isFocus.value = true
      })
      this.selectedsDisplay.addEventListener('focusin', e => {
        if(this.selectedsDisplay !== e.target) return
        field.isFocus.value = true
      }, { passive: true })

      this.selectedsDisplay.addEventListener('focusout', e => {
        if(this.selectedsDisplay !== e.target) return
        field.isFocus.value = false
      }, { passive: true })

      effect(() => {
        if(field.isFocus.value) this.selectedsDisplay.focus()
      })

      const onOptionsContainerMouseMove = () => {
        this.isNavigating.value = false
      }

      this.isNavigating.subscribe(value => {
        if(value) this.optionsContainer.addEventListener('mousemove', onOptionsContainerMouseMove, { passive: true })
        else this.optionsContainer.removeEventListener('mousemove', onOptionsContainerMouseMove)
        this.optionsContainer.classList.toggle('isNavigating', this.isNavigating.value)
        this.optionsContainer.classList.toggle('isNotNavigating', !this.isNavigating.value)
      })

      effect(() => {
        const displayValue = this.getSelectedsDisplayValue()
        this.selectedsDisplay.innerHTML = displayValue === "" ? "&nbsp;" : displayValue
        this.selectedsDisplay.title = displayValue
      })

      effect(() => {
        this.optionsContainer.innerHTML = ""
        for (let i = 0; i < this.options.value.length; i++) {
          const option = this.options.value[i]

          const classList = ['field__option']
          if (this.selecteds.value.includes(i)) classList.push('isSelected')
          if (this.select.multiple && i === this.navIndex.value) classList.push('isActive')

          const optionElement = createElement('div', {
            classList: classList,
            children: [option.label],
          })

          // dont get focus on pointerdown
          optionElement.addEventListener('pointerdown', e => e.preventDefault())

          optionElement.addEventListener('click', e => {
            e.preventDefault()
            this.toggleOption(i)
            if (!this.select.multiple) this.isOpen.value = false
          })

          this.optionsContainer.appendChild(optionElement)

        }
      })

      if (this.isOpen) effect(() => this.el.classList.toggle('isOpen', this.isOpen.value))
    }

    this.getSelectedsDisplayValue = function () {
      if (!this.selecteds) return ""
      return this.selecteds.value.reduce((acc, curr) => {
        const option = this.options.value[curr]
        if (option) acc.push(option.label)
        return acc
      }, []).join(', ')
    }

    /**
     * @param {HTMLElement} field
     * @returns {Signal}
     */
    this.createSelectOpenSignal = function () {
      const isOpenSignal = signal(false)

      this.el.addEventListener("pointerdown", e => {
        if (e.target.classList.contains("field__option")) return
        if (e.target.classList.contains("field__options")) return
        isOpenSignal.value = !isOpenSignal.value
      })

      field.isFocus.subscribe((isFocus) => {
        if(isFocus || isFocus === isOpenSignal.value) return
        isOpenSignal.value = isFocus
      })

      return isOpenSignal
    }

    /**
     * @returns {Signal}
     */
    this.createSelectOptionsSignal = function () {

      const options = []

      for (let i = 0; i < this.select.options.length; i++) {
        const option = this.select.options[i]
        options.push({
          id: i,
          label: option.innerText,
          value: option.value,
          nativeOption: option
        })
      }

      return signal(options)
    }

    /**
     * @returns {Signal<Array<number>>}
     */
    this.createSelectSelectedsSignal = function () {
      const selected = []

      for (let i = 0; i < this.select.options.length; i++) {
        const option = this.select.options[i]
        if (option.selected) selected.push(i)
      }

      const selectedsSignal = signal(selected)

      selectedsSignal.subscribe(value => {
        for (let i = 0; i < this.select.options.length; i++) {
          const option = this.select.options[i];
          const isSelected = value.includes(i)

          option.selected = isSelected
        }

        if (value.length === 0) this.select.selectedIndex = -1;
      })

      return selectedsSignal
    }

    this.navigate = e => {

      if(!this.isOpen.value && [" ", "Enter", "ArrowDown", "ArrowUp"].includes(e.key)) {
        this.isOpen.value = true
        return
      } else if(this.isOpen.value && ["Escape", "Tab"].includes(e.key)) {
        e.preventDefault()
        this.isOpen.value = false
        return
      }

      if(!this.isOpen.value) return

      if(e.key === "Enter") {
        if(this.select.multiple) {
          this.toggleOption(this.navIndex.value)
        } else {
          this.isOpen.value = false
        }
      } else if(["ArrowDown", "ArrowUp"].includes(e.key)) {
        this.isNavigating.value = true

        let currentIndex = undefined

        currentIndex = this.selecteds.value[this.selecteds.value.length - 1]

        if(this.select.multiple) currentIndex = this.navIndex.value

        if(typeof currentIndex === "undefined") {
          currentIndex = 0
        } else {
          if(e.key === "ArrowUp") currentIndex--
          else if (e.key === "ArrowDown") currentIndex++
          if(currentIndex < 0) currentIndex = this.select.options.length - 1
          else if(currentIndex > this.select.options.length - 1) currentIndex = 0
        }

        if(this.select.multiple) this.navIndex.value = currentIndex
        else this.toggleOption(currentIndex)
      }
    }

    this.toggleOption = function (idx) {
      const activeOption = this.select.options[idx]

      if(!activeOption) return

      if (this.selecteds.value.includes(idx)) {
        this.selecteds.value = this.selecteds.value.filter((value) => value !== idx)
      } else {
        if (this.select.multiple) this.selecteds.value = [...this.selecteds.value, idx]
        else this.selecteds.value = [idx]
      }
    }

    this.init();
  }

  this.init()
  return {
    isOpen: this.isOpen,
    selecteds: this.selecteds,
    options: this.options,
  }
}