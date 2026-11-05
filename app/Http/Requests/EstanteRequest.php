<?php

namespace App\Http\Requests;

use App\Models\Estante;
use Illuminate\Foundation\Http\FormRequest;

// Se usa tanto para CREAR un estante como para EDITARLO
class EstanteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        // Al editar, la ruta trae el estante ({estante}); al crear, no hay ninguno (null)
        $estante = $this->route('estante');

        // Al editar, la capacidad no puede bajar de donde hay prendas
        $minimo = $estante ? max(1, $estante->capacidadMinima()) : 1;

        return [
            'nombre'    => ['required', 'string', 'max:50'],
            'capacidad' => ['required', 'integer', 'min:' . $minimo, 'max:' . Estante::CAPACIDAD_MAXIMA],
            'por_fila'  => ['required', 'integer', 'between:1,' . Estante::POR_FILA_MAXIMO],
        ];
    }

    public function messages(): array
    {
        return [
            'required'      => 'El campo :attribute es obligatorio.',
            'string'        => 'El campo :attribute debe ser un texto.',
            'integer'       => 'El campo :attribute debe ser un número entero.',
            'max'           => 'El campo :attribute no puede superar :max.',
            'between'       => 'El campo :attribute debe estar entre :min y :max.',
            'capacidad.min' => 'Hay prendas hasta el casillero :min: la capacidad no puede ser menor.',
        ];
    }

    public function attributes(): array
    {
        return [
            'por_fila' => 'prendas por fila',
        ];
    }
}