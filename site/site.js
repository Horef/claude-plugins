// Copy buttons for code blocks. Everything else on the site works without JavaScript.
document.querySelectorAll('.code').forEach(function (box) {
  var btn = document.createElement('button')
  btn.type = 'button'
  btn.textContent = 'Copy'
  btn.setAttribute('aria-label', 'Copy to clipboard')
  btn.addEventListener('click', function () {
    var text = box.querySelector('pre').innerText.replace(/\s+$/, '')
    var done = function () {
      btn.textContent = 'Copied'
      setTimeout(function () { btn.textContent = 'Copy' }, 1500)
    }
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () {})
    else {
      var ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy'); done() } catch (e) {}
      document.body.removeChild(ta)
    }
  })
  box.appendChild(btn)
})

// Open the card an anchor points into (a link to #helpers should show it).
function openTarget() {
  var el = location.hash && document.getElementById(location.hash.slice(1))
  var card = el && el.closest('details')
  if (card) card.open = true
}
window.addEventListener('hashchange', openTarget)
openTarget()
