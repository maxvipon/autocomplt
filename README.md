# autocomplt

## What is autocomplt?

The autocomplt is written in Javascript and lightweight and simple to use. It auto-generates the autocomplete list when user inputs some text in the &lt;input&gt; element.

Try it here at [jsfiddle](http://jsfiddle.net/Fischer/eTw62/)

## No need of any extra lib/framework

The autocomplt has no dependencies on other libs or frameworks.

## How to use

### Load the script

Load the autocomplt js script into your document. After loading, there would be one global object called autocomplt. Use that global autocomplt object to enable the autocomplete feature on the desired &lt;input&gt; element.

### Example

Suppose the HTML:

```html
<input name="name" type="text"></input>
````

Call autocomplt.enable to enable the autocompelte feature on the `<input>` element above as below:

```js
var input = document.querySelector("input[name=name]");

autocomplt.enable(input, {
    // the hintsFetcher is your customized function
    // which searchs the proper autocomplete hints based on the user's input value.
    hintsFetcher: function (v, openList) {
        var hints = [],
            names = [ "Masahiro Tanaka", "Darvish", "Daisuke Matsuzaka" ];
        
        for (var i = 0; i < names.length; i++) {
            if (names[i].indexOf(v) >= 0) {
                hints.push(names[i]);
            }
        }
        
        openList(hints);
    }
});
```

After running the codes here, the autocomplete list will appear to give the hints for users.

## Configuration and styles

The `<input>` element which is enabled with the autocomplete feature would carrys one property named "autocomplt". Use that property's input.autocomplt.config method to config the autocomplete features and input.autocomplt.setStyles to change the UI styles. There are more public APIs for use, please refer to the autocomplt.js.
