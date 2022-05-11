# SCSA pseudocode
> undermining the concept of pseudocode

SCSA, the authority that writes my school's curriculum, has their own flavour of pseudocode. They teach this to avoid teaching a real programming language. But the joke's on them, because their pseudocode is now a real language.

There's no spec for it, and their information conflicts at times, but this implementation is capable of running a decent amount of the examples I can find.

This repo has a lexer and a recursive descent parser with backtracking, and a stack bytecode compiler and virtual machine. It also has a vscode extension for syntax highlighting.

## Use
```sh
npm install
npm run build
./bin/scsa.js examples/small.scsa
```

```sh
cd vscode
npx vsce package
# now right click on scsa-pseudocode-*.vsix in vscode and install
```

## TODO
### garbage collection
Objects with a negative ID are dynamically allocated. On occasion, when `Interpreter.prototype.alloc` is called, all positive objects on the heap, as well as anything on the stack, should be recursively marked. Then, any negative objects not marked as reachable can be removed.

### stack frames
All variables are global right now, and while technically all examples run fine, this is problematic. Function scopes should contain the variables they declare. I need to add stack frames to the interpreter so that variables can be local to functions.

### operator precedence
All binary operators are currently parsed left to right.
