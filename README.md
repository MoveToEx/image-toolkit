# image-toolkit

A utility tool used to accelerate image dataset processing.  

Based on [PyTauri](https://pytauri.github.io/pytauri/latest/) and [React](https://react.dev/).

## Setup

Prerequisites:
- [uv](https://docs.astral.sh/uv/)
- [Node.js](https://nodejs.org/)
- Rust toolchain (`cargo`)

```sh
$ git clone https://github.com/MoveToEx/image-toolkit.git
$ cd image-toolkit
$ uv sync                         # install Python dependencies
$ yarn                            # install JS dependencies
$ source ./.venv/Scripts/activate # activate venv
$ yarn tauri dev                  # run in dev mode
```