<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Estante extends Model
{
    // Límites del modo edición. Se usan en las validaciones y se envían a la vista.
    public const CAPACIDAD_MAXIMA = 40;
    public const POR_FILA_MAXIMO = 5;

    // Tamaño de un estante nuevo (en píxeles del mapa)
    public const ANCHO_POR_DEFECTO = 220;
    public const ALTO_POR_DEFECTO = 120;

    // Hasta dónde pueden llegar los estantes hacia abajo: 10 px sobre la zona "Sin ubicar" (que empieza en 430)
    public const LIMITE_INFERIOR_MAPA = 420;

    // Ancho del mapa que damos por seguro al buscar un lugar libre
    public const ANCHO_MAPA_SEGURO = 900;

    protected $fillable = [
        'nombre',
        'posicion_x',
        'posicion_y',
        'ancho',
        'alto',
        'capacidad',
        'por_fila',
    ];

    // Un estante tiene muchos productos
    public function productos(): HasMany
    {
        return $this->hasMany(Producto::class);
    }

    // Devuelve el número del primer casillero libre (0, 1, 2...) o null si está lleno.
    public function buscarCasilleroLibre(): ?int
    {
        // Lista de casilleros que ya tienen prenda
        $usados = $this->productos()
            ->whereNotNull('casillero')
            ->pluck('casillero')
            ->map(fn ($casillero) => (int) $casillero)
            ->all();

        // Recorremos los casilleros del estante en orden y devolvemos el primero que no está usado
        for ($numero = 0; $numero < $this->capacidad; $numero++) {
            if (! in_array($numero, $usados, true)) {
                return $numero;
            }
        }

        return null;
    }

    // NUEVO: la capacidad más baja que se le puede poner a este estante.
    // Es el número del casillero más alto en uso (casillero 4 = hace falta capacidad 5).
    public function capacidadMinima(): int
    {
        $masAlto = $this->productos()->max('casillero');

        return $masAlto === null ? 1 : ((int) $masAlto + 1);
    }

    // NUEVO: busca un lugar libre en el mapa para un estante de ese tamaño.
    // Recorre el mapa de 20 en 20 píxeles y devuelve ['x' => ..., 'y' => ...], o null si no hay lugar.
    public static function buscarPosicionLibre(
        int $ancho = self::ANCHO_POR_DEFECTO,
        int $alto = self::ALTO_POR_DEFECTO
    ): ?array {
        // Se leen los estantes una sola vez, no en cada prueba
        $existentes = self::all(['posicion_x', 'posicion_y', 'ancho', 'alto']);

        for ($y = 20; $y + $alto <= self::LIMITE_INFERIOR_MAPA; $y += 20) {
            for ($x = 20; $x + $ancho <= self::ANCHO_MAPA_SEGURO; $x += 20) {

                // Se deja un margen de 20 px para que no queden pegados
                $ocupado = $existentes->contains(
                    fn ($otro) => self::sePisan($x, $y, $ancho, $alto, $otro, 20)
                );

                if (! $ocupado) {
                    return ['x' => $x, 'y' => $y];
                }
            }
        }

        return null;
    }

    // ¿Dos rectángulos se pisan? (con un margen opcional de separación)
    private static function sePisan(int $x, int $y, int $ancho, int $alto, $otro, int $margen = 0): bool
    {
        return $x < $otro->posicion_x + $otro->ancho + $margen
            && $x + $ancho + $margen > $otro->posicion_x
            && $y < $otro->posicion_y + $otro->alto + $margen
            && $y + $alto + $margen > $otro->posicion_y;
    }
}