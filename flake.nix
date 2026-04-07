{
  description = "Primitive SDKs";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    { nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            biome
            git
            jq
            nil
            nix
            nixd
            nixfmt
            nodejs_22
            pnpm
            ripgrep
            typescript-language-server
          ];

          shellHook = ''
            echo "primitive-sdks dev shell active"
          '';
        };
      }
    );
}
