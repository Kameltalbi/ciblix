/**
 * Règles de mot de passe partagées (inscription, reset, users admin).
 */
export const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&+._\-#])[A-Za-z\d@$!%*?&+._\-#]{8,}$/;

export const PASSWORD_RULE_MSG =
  'Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial (@$!%*?&+._-#)';
