import {
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength
} from 'class-validator';


export class LoginRequestDto {

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(12)
  username!: string;


  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(12)
  password!: string;
}